import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useDeleteTutor = () => {
  const queryClient = useQueryClient();

  const deleteTutor = async (tutorId) => {
    const response = await api.delete(`/tutors/${tutorId}`);
    return response.data;
  };

  return useMutation(deleteTutor, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("tutors");
      message.success(success.message);
    },
    onError: (error) => {
      queryClient.invalidateQueries("tutors");
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later.",
        5
      );
    },
  });
};

export default useDeleteTutor;
