import { useContext, useEffect, useMemo } from "react";
import { UserContext } from "../UserContext";
import { useQuery, useQueryClient } from "react-query";
import api from "./api";

const convertLocalDate = (utcTime) => {
  const localDate = new Date(utcTime);
  return localDate;
};

const useGetLessons = ({ currentFetchedDate, setRefetchDate }) => {
  const queryClient = useQueryClient(); // <-- Correct way
  const { user } = useContext(UserContext);
  const { role, role_id, id } = user;

  const getLessons = async () => {
    if (!role) return [];
    const response = await api.get(
      `/lessons/${role}${role === "admin" ? "" : `/${role_id}`}`,
      {
        params: {
          current_fetched_date: currentFetchedDate,
        },
      }
    );

    setRefetchDate(
      response.data.extended_until
        ? new Date(response.data.extended_until)
        : null
    );

    const formattedLessons = response.data.lessons.map((lesson) => ({
      ...lesson,
      start_time: lesson.start_time
        ? convertLocalDate(lesson.start_time)
        : null,
      end_time: lesson.end_time ? convertLocalDate(lesson.end_time) : null,
      actual_start_time: lesson.actual_start_time
        ? convertLocalDate(lesson.actual_start_time)
        : null,
      actual_end_time: lesson.actual_end_time
        ? convertLocalDate(lesson.actual_end_time)
        : null,
    }));

    return formattedLessons;
  };

  const queryKey = useMemo(
    () => ["lessons", id, new Date(currentFetchedDate).setHours(0, 0, 0, 0)],
    [id, currentFetchedDate]
  );

  useEffect(() => {
    queryClient.invalidateQueries(queryKey);
  }, [queryClient, queryKey]);

  return useQuery(queryKey, getLessons);
};

export default useGetLessons;
