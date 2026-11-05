import { useCallback, useRef, useState } from "react";

export function useFeatureBusy() {
  const [isCommonLoading, setIsCommonLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);
  const busyCountRef = useRef(0);

  const runWhileBusy = useCallback(async <T>(task: () => Promise<T>): Promise<T> => {
    busyCountRef.current += 1;
    setIsCommonLoading(true);

    try {
      return await task();
    } finally {
      busyCountRef.current -= 1;
      if (busyCountRef.current <= 0) {
        busyCountRef.current = 0;
        setIsCommonLoading(false);
      }
    }
  }, []);

  return {
    isCommonLoading,
    setIsCommonLoading,
    runWhileBusy,
    download: {
      isLoading: isDownloadLoading,
      setIsLoading: setIsDownloadLoading,
    },
  };
}
