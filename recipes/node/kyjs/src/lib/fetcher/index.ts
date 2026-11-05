import ky from "ky";

const API_BASE_URL = "https://api.example.com";

type QueuedRequest = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const retryWithToken = (request: Request, token: string) => {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return ky.retry({
    request: new Request(request, { headers }),
    code: "TOKEN_REFRESHED",
  });
};

const apiClient = ky.create({
  prefix: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async ({ request, response, retryCount }) => {
        if (response.status !== 401 || retryCount > 0) {
          return response;
        }

        if (isRefreshing) {
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (!token) {
              throw new Error("Missing access token after refresh");
            }
            return retryWithToken(request, token);
          });
        }

        isRefreshing = true;

        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          isRefreshing = false;
          // TODO: handle unauthorized (clear session, redirect to login, etc.)
          return response;
        }

        try {
          const { accessToken, newRefreshToken } = await ky
            .post(`${API_BASE_URL}/auth/refresh`, {
              json: { refreshToken },
            })
            .json<{ accessToken: string; newRefreshToken?: string }>();

          localStorage.setItem("accessToken", accessToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }

          processQueue(null, accessToken);
          return retryWithToken(request, accessToken);
        } catch (refreshError) {
          processQueue(refreshError, null);
          // TODO: handle unauthorized (clear session, redirect to login, etc.)
          throw refreshError;
        } finally {
          isRefreshing = false;
        }
      },
    ],
  },
});

export default apiClient;
