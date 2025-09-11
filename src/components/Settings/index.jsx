import { useContext, useState } from "react";
import { UserContext } from "../../UserContext";
import UsersTable from "./UsersTable";
import EditableTable from "./EditableTable";
import useGetUsers from "../../hooks/useGetUsers";
import useGetTutors from "../../hooks/useGetTutors";
import useGetStudents from "../../hooks/useGetStudents";
import useGetLocations from "../../hooks/useGetLocations";
import useGetSubjects from "../../hooks/useGetSubjects";
import useUpdateTutor from "../../hooks/useUpdateTutor";
import useUpdateStudent from "../../hooks/useUpdateStudent";
import useUpdateLocation from "../../hooks/useUpdateLocation";
import useUpdateSubject from "../../hooks/useUpdateSubject";
import useDeleteTutor from "../../hooks/useDeleteTutor";
import useDeleteStudent from "../../hooks/useDeleteStudent";
import useDeleteLocation from "../../hooks/useDeleteLocation";
import useDeleteSubject from "../../hooks/useDeleteSubject";
import useAddTutor from "../../hooks/useAddTutor";
import useAddStudent from "../../hooks/useAddStudent";
import useAddLocation from "../../hooks/useAddLocation";
import useAddSubject from "../../hooks/useAddSubject";
import { Tabs } from "antd";
import "./index.css";

export default function Settings() {
  const { user } = useContext(UserContext);
  const { role } = user;
  const [currentOption, setCurrentOption] = useState("students");

  const {
    data: usersData,
    isLoading: usersDataLoading,
    isError: usersDataError,
  } = useGetUsers();
  const {
    data: tutorsData,
    isLoading: tutorsDataLoading,
    isError: tutorsDataError,
  } = useGetTutors();
  const {
    data: studentsData,
    isLoading: studentsDataLoading,
    isError: studentsDataError,
  } = useGetStudents();
  const {
    data: locationsData,
    isLoading: locationsDataLoading,
    isError: locationsDataError,
  } = useGetLocations();
  const {
    data: subjectsData,
    isLoading: subjectsDataLoading,
    isError: subjectsDataError,
  } = useGetSubjects();

  const addTutor = useAddTutor();
  const addStudent = useAddStudent();
  const addLocation = useAddLocation();
  const addSubject = useAddSubject();

  const updateTutor = useUpdateTutor();
  const updateStudent = useUpdateStudent();
  const updateLocation = useUpdateLocation();
  const updateSubject = useUpdateSubject();

  const deleteTutor = useDeleteTutor();
  const deleteStudent = useDeleteStudent();
  const deleteLocation = useDeleteLocation();
  const deleteSubject = useDeleteSubject();

  const getSettingsOptions = () => {
    switch (role) {
      case "admin":
        return [
          {
            key: "students",
            label: "Students",
          },
          {
            key: "tutors",
            label: "Tutors",
          },

          {
            key: "locations",
            label: "Locations",
          },
          {
            key: "subjects",
            label: "Subjects",
          },
          {
            key: "users",
            label: "Users",
          },
        ];
      case "tutor":
        return [];
      case "student":
        return [];
      default:
        return;
    }
  };
  return (
    <>
      <title className="settings--title">
        <h3>Settings</h3>
      </title>
      <Tabs
        items={getSettingsOptions()}
        onChange={(value) => setCurrentOption(value)}
      />

      {currentOption === "users" && (
        <main className="settings--table ">
          <UsersTable
            data={usersData?.filter((u) => u.id !== user.id)}
            isLoading={usersDataLoading}
            isError={usersDataError}
          />
        </main>
      )}
      {currentOption === "tutors" && (
        <main className="settings--table ">
          <EditableTable
            name="tutor"
            data={tutorsData}
            addData={addTutor.mutate}
            updateData={updateTutor.mutate}
            deleteData={deleteTutor.mutate}
            isLoading={tutorsDataLoading}
            isError={tutorsDataError}
            isMutateError={deleteTutor.isError}
          />
        </main>
      )}
      {currentOption === "students" && (
        <main className="settings--table ">
          <EditableTable
            name="student"
            data={studentsData}
            addData={addStudent.mutate}
            updateData={updateStudent.mutate}
            deleteData={deleteStudent.mutate}
            isLoading={studentsDataLoading}
            isError={studentsDataError}
            isMutateError={deleteStudent.isError}
          />
        </main>
      )}
      {currentOption === "locations" && (
        <main className="settings--table ">
          <EditableTable
            name="location"
            data={locationsData}
            addData={addLocation.mutate}
            updateData={updateLocation.mutate}
            deleteData={deleteLocation.mutate}
            isLoading={locationsDataLoading}
            isError={locationsDataError}
            isMutateError={deleteLocation.isError}
          />
        </main>
      )}
      {currentOption === "subjects" && (
        <main className="settings--table ">
          <EditableTable
            name="subject"
            data={subjectsData}
            addData={addSubject.mutate}
            updateData={updateSubject.mutate}
            deleteData={deleteSubject.mutate}
            isLoading={subjectsDataLoading}
            isError={subjectsDataError}
            isMutateError={deleteSubject.isError}
          />
        </main>
      )}
    </>
  );
}
