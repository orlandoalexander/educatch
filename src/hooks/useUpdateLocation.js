import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateLocation = async ({ id: locationId, data }) => {
  const response = await api.put(`/locations/${locationId}`, data);
  return response.data;
};

const useUpdateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation(updateLocation, {
    onSuccess: () => queryClient.invalidateQueries("locations"),
  });
};

export default useUpdateLocation;
