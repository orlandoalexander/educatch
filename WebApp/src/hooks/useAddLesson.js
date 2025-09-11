import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { useContext } from "react";
import { UserContext } from "../UserContext";
import { message } from "antd";

const useAddLesson = () => {
  const { user } = useContext(UserContext);
  const { id } = user;
  const queryClient = useQueryClient();

  const addLesson = async (data) => {
    const hide = message.loading("Adding lesson...", 0); // show loading
    try {
      const response = await api.post("/lessons", data);
      return { success: response.data, hide };
    } catch (error) {
      hide(); // hide loading if error
      throw error;
    }
  };

  return useMutation(addLesson, {
    onSuccess: ({ success, hide }) => {
      hide(); // hide loading on success
      queryClient.invalidateQueries(["lessons", id]);
      queryClient.invalidateQueries(["reports", id]);
      message.success(success.message);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useAddLesson;
