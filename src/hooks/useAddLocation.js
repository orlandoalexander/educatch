import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useAddLocation = () => {
  const queryClient = useQueryClient();

  const addLocation = async (data) => {
    const response = await api.post(`/locations`, data);
    return response.data;
  };

  return useMutation(addLocation, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("locations");
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

export default useAddLocation;
