import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useResetDemoDb = () => {
  const resetDemoDb = async () => {
    const response = await api.post("/reset-db");
    return response.data;
  };

  return useMutation(resetDemoDb, {
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to reset demo database."
      );
    },
  });
};

export default useResetDemoDb;
