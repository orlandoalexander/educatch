import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useDeleteStudent = () => {
  const queryClient = useQueryClient();

  const deleteStudent = async (studentId) => {
    const response = await api.delete(`/students/${studentId}`);
    return response.data;
  };

  return useMutation(deleteStudent, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("students");
      message.success(success.message);
    },
    onError: (error) => {
      queryClient.invalidateQueries("students");
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later.",
        5
      );
    },
  });
};

export default useDeleteStudent;
