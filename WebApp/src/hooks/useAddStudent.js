import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useAddStudent = () => {
  const queryClient = useQueryClient();

  const addStudents = async (data) => {
    const response = await api.post(`/students`, data);
    return response.data;
  };

  return useMutation(addStudents, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("students");
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

export default useAddStudent;
