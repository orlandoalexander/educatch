import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useAddTutor = () => {
  const queryClient = useQueryClient();

  const addTutor = async (data) => {
    const hide = message.loading("Adding tutor...");
    try {
      const response = await api.post(`/tutors`, data);
      return { success: response.data, hide };
    } catch (error) {
      hide(); // hide loading if error
      throw error;
    }
  };

  return useMutation(addTutor, {
    onSuccess: ({ success, hide }) => {
      hide(); // hide loading on success
      queryClient.invalidateQueries("tutors");
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

export default useAddTutor;
