import { useMutation, useQueryClient } from "react-query";
import api from "./api";
import { message } from "antd";

const useDeleteLocation = () => {
  const queryClient = useQueryClient();

  const deleteLocation = async (locationId) => {
    const response = await api.delete(`/locations/${locationId}`);
    return response.data;
  };

  return useMutation(deleteLocation, {
    onSuccess: (success) => {
      queryClient.invalidateQueries("locations");
      message.success(success.message);
    },
    onError: (error) => {
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later.",
        5
      );
      queryClient.invalidateQueries("locations");
    },
  });
};

export default useDeleteLocation;
