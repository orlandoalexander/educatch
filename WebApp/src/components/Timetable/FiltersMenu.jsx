import { useState } from "react";
import PropTypes from "prop-types";
import { Button, Dropdown, Badge } from "antd";
import { Filter } from "react-feather";
import CalendarFilter from "./CalendarFilter";
import "./FiltersMenu.css";

export default function FiltersMenu({
  filterOptions,
  studentsDataLoading,
  tutorsDataLoading,
  locationsDataLoading,
  subjectsDataLoading,
  selectedFilters,
  setSelectedFilters,
}) {
  const [filtersActive, setFiltersActive] = useState({
    student: false,
    tutor: false,
    location: false,
    subject: false,
  });

  const items = [
    {
      key: "1",
      label: (
        <div onClick={(e) => e.stopPropagation()}>
          <CalendarFilter
            name="student"
            filterOptions={filterOptions.students}
            filterOptionsLoading={studentsDataLoading}
            selectedFilters={selectedFilters.students}
            setSelectedFilters={(value) =>
              setSelectedFilters({ ...selectedFilters, students: value })
            }
            filtersActive={filtersActive}
            setFiltersActive={setFiltersActive}
          />
        </div>
      ),
    },
    {
      key: "2",
      label: (
        <div onClick={(e) => e.stopPropagation()}>
          <CalendarFilter
            name="tutor"
            filterOptions={filterOptions.tutors}
            filterOptionsLoading={tutorsDataLoading}
            selectedFilters={selectedFilters.tutors}
            setSelectedFilters={(value) =>
              setSelectedFilters({ ...selectedFilters, tutors: value })
            }
            filtersActive={filtersActive}
            setFiltersActive={setFiltersActive}
          />
        </div>
      ),
    },
    {
      key: "3",
      label: (
        <div onClick={(e) => e.stopPropagation()}>
          <CalendarFilter
            name="location"
            filterOptions={filterOptions.locations}
            filterOptionsLoading={locationsDataLoading}
            selectedFilters={selectedFilters.locations}
            setSelectedFilters={(value) =>
              setSelectedFilters({ ...selectedFilters, locations: value })
            }
            filtersActive={filtersActive}
            setFiltersActive={setFiltersActive}
          />
        </div>
      ),
    },
    {
      key: "4",
      label: (
        <div onClick={(e) => e.stopPropagation()}>
          <CalendarFilter
            name="subject"
            filterOptions={filterOptions.subjects}
            filterOptionsLoading={subjectsDataLoading}
            selectedFilters={selectedFilters.subjects}
            setSelectedFilters={(value) =>
              setSelectedFilters({ ...selectedFilters, subjects: value })
            }
            filtersActive={filtersActive}
            setFiltersActive={setFiltersActive}
          />
        </div>
      ),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Badge
        count={
          Object.values(filtersActive).filter((value) => value === true).length
        }
      >
        <Button icon={<Filter size={15} />}>Show Filters</Button>
      </Badge>
    </Dropdown>
  );
}

FiltersMenu.propTypes = {
  filterOptions: PropTypes.object,
  studentsDataLoading: PropTypes.bool,
  tutorsDataLoading: PropTypes.bool,
  locationsDataLoading: PropTypes.bool,
  subjectsDataLoading: PropTypes.bool,
  selectedFilters: PropTypes.object,
  setSelectedFilters: PropTypes.func,
};
