import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../UserContext";
import { Button, Switch } from "antd";
import { Plus, LogOut } from "react-feather";
import Calendar from "../Calendar";
import useGetTutors from "../../hooks/useGetTutors";
import useGetStudents from "../../hooks/useGetStudents";
import useGetLocations from "../../hooks/useGetLocations";
import useGetSubjects from "../../hooks/useGetSubjects";
import FiltersMenu from "./FiltersMenu";
import DownloadMenu from "./DownloadMenu";
import "./index.css";

export default function Timetable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleSignOut } = useContext(UserContext);
  const { user } = useContext(UserContext);
  const { role } = user;

  const [isStudentView, setIsStudentView] = useState(
    localStorage.getItem("educatch_isStudentView") === "true"
  );
  const [selectedFilters, setSelectedFilters] = useState({
    students: [],
    locations: [],
    subjects: [],
    tutors: [],
  });
  const [filterOptions, setFilterOptions] = useState({
    students: [],
    locations: [],
    subjects: [],
    tutors: [],
  });
  const { data: tutorsData, isLoading: tutorsDataLoading } = useGetTutors();
  const { data: studentsData, isLoading: studentsDataLoading } =
    useGetStudents();
  const { data: locationsData, isLoading: locationsDataLoading } =
    useGetLocations();
  const { data: subjectsData, isLoading: subjectsDataLoading } =
    useGetSubjects();

  const handleOpenNewLesson = ({ date }) => {
    navigate(`/timetable/new${date ? "/" + date : ""}`);
  };

  const formatOptions = (data) => {
    return data.map((item) => ({
      value: item.id,
      label: item.name,
    }));
  };

  useEffect(() => {
    if (
      tutorsData?.records &&
      filterOptions.tutors.length === 0 &&
      studentsData?.records &&
      filterOptions.students.length === 0 &&
      locationsData?.records &&
      filterOptions.locations.length === 0 &&
      subjectsData?.records &&
      filterOptions.subjects.length === 0
    ) {
      const tutors = formatOptions(tutorsData.records);
      const students = formatOptions(studentsData.records);
      const locations = formatOptions(locationsData.records);
      const subjects = formatOptions(subjectsData.records);
      setFilterOptions((prevData) => ({
        ...prevData,
        tutors,
        students,
        locations,
        subjects,
      }));
      setSelectedFilters({
        tutors: tutors.map((tutor) => tutor.value),
        students: students.map((student) => student.value),
        locations: locations.map((location) => location.value),
        subjects: subjects.map((subject) => subject.value),
      });
    }
  }, [
    tutorsData,
    studentsData,
    locationsData,
    subjectsData,
    filterOptions,
    selectedFilters,
  ]);
  return (
    <>
      <header className="timetable--header">
        <section>
          <h3>{role === "admin" ? "Timetable" : "Your timetable"}</h3>
          {role === "admin" ? (
            <Switch
              checkedChildren="Student"
              unCheckedChildren="Tutor"
              value={isStudentView}
              onChange={() =>
                setIsStudentView((prevData) => {
                  localStorage.setItem("educatch_isStudentView", !prevData);
                  return !prevData;
                })
              }
            />
          ) : (
            <DownloadMenu />
          )}
        </section>

        {role === "admin" && (
          <section>
            <DownloadMenu />
            <FiltersMenu
              filterOptions={filterOptions}
              studentsDataLoading={studentsDataLoading}
              tutorsDataLoading={tutorsDataLoading}
              locationsDataLoading={locationsDataLoading}
              subjectsDataLoading={subjectsDataLoading}
              selectedFilters={selectedFilters}
              setSelectedFilters={setSelectedFilters}
            />
            <Button
              onClick={handleOpenNewLesson}
              disabled={location.pathname === "/timetable/new"}
              type="primary"
              size="medium"
              icon={<Plus />}
            >
              New Lesson
            </Button>
          </section>
        )}
        {role === "student" && (
          <Button
            onClick={handleSignOut}
            icon={<LogOut size={15} style={{ transform: "rotate(180deg)" }} />}
          >
            Logout
          </Button>
        )}
      </header>
      <Calendar
        handleOpenNewLesson={handleOpenNewLesson}
        selectedFilters={selectedFilters}
        isStudentView={isStudentView}
      />
    </>
  );
}
