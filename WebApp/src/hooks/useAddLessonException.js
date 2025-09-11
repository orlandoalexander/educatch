import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { useContext } from "react";
import { UserContext } from "../UserContext";
import { message } from "antd";

const useAddLessonException = () => {
  const { user } = useContext(UserContext);
  const { id } = user;
  const queryClient = useQueryClient();

  const addException = async (data) => {
    const hide = message.loading(
      `${data.exception_type === "CANCEL" ? "Deleting" : "Updating"} lesson...`,
      0
    );
    try {
      const response = await api.post(`/lesson_exceptions`, data);
      return { success: response.data, data, hide };
    } catch (error) {
      hide(); // hide loading if error
      throw error;
    }
  };

  return useMutation(addException, {
    onSuccess: ({ success, data, hide }) => {
      hide();
      queryClient.invalidateQueries([
        "lesson--report",
        data.lesson_occurrence_id,
      ]);
      queryClient.invalidateQueries(["lessons", id]);
      queryClient.invalidateQueries(["reports", id]);
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

export default useAddLessonException;
