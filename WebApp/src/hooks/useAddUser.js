import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useAddUser = () => {
  const addUser = async (data) => {
    const response = await api.post(`/users`, data);

    return response.data;
  };

  return useMutation(addUser, {
    onSuccess: (success) => {
      message.success(success.message, 5);
    },
    onError: (error) => {
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useAddUser;
