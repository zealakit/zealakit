import { ref } from "vue";

export function useFeatureBusy() {
  const isCommonLoading = ref(false);
  const isDownloadLoading = ref(false);
  let busyCount = 0;

  const setIsCommonLoading = (loading: boolean) => {
    isCommonLoading.value = loading;
  };

  const runWhileBusy = async <T>(task: () => Promise<T>): Promise<T> => {
    busyCount += 1;
    isCommonLoading.value = true;

    try {
      return await task();
    } finally {
      busyCount -= 1;
      if (busyCount <= 0) {
        busyCount = 0;
        isCommonLoading.value = false;
      }
    }
  };

  return {
    isCommonLoading,
    setIsCommonLoading,
    runWhileBusy,
    download: {
      isLoading: isDownloadLoading,
      setIsLoading: (loading: boolean) => {
        isDownloadLoading.value = loading;
      },
    },
  };
}
