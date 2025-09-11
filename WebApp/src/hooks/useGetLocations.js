import { useQuery } from "react-query";
import api from "./api";

const useGetLocations = () => {
  const getLocations = async () => {
    const response = await api.get(`/locations`);

    return response.data;
  };

  return useQuery("locations", getLocations);
};

export default useGetLocations;
