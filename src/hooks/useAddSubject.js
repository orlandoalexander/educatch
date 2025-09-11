import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useAddSubject = () => {
  const queryClient = useQueryClient();

  const addSubject = async (data) => {
    const response = await api.post(`/subjects`, data);
    return response.data;
  };

  return useMutation(addSubject, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("subjects");
      message.success(success.message);
    },
    onError: (error) => {
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useAddSubject;
