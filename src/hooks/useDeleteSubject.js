import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useDeleteSubject = () => {
  const queryClient = useQueryClient();

  const deleteSubject = async (subjectId) => {
    const response = await api.delete(`/subjects/${subjectId}`);
    return response.data;
  };

  return useMutation(deleteSubject, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("subjects");
      message.success(success.message);
    },
    onError: (error) => {
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later.",
        5
      );
      queryClient.invalidateQueries("subjects");
    },
  });
};

export default useDeleteSubject;
