import axios from "axios";

const API_BASE_URL = "https://api.example.com";

type QueuedRequest = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

type RetryableRequest = {
  _retry?: boolean;
  headers: {
    Authorization?: string;
  };
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

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

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    if (error.response?.status !== 401 || originalRequest?._retry || !originalRequest) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      isRefreshing = false;
      // TODO: handle unauthorized (clear session, redirect to login, etc.)
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });
      const { accessToken, newRefreshToken } = response.data as {
        accessToken: string;
        newRefreshToken?: string;
      };

      localStorage.setItem("accessToken", accessToken);
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }

      processQueue(null, accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // TODO: handle unauthorized (clear session, redirect to login, etc.)
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
