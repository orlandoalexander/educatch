import PropTypes from "prop-types";
import { Select, Checkbox } from "antd";
import "./CalendarFilter.css";

export default function CalendarFilter({
  name,
  filterOptions,
  filterOptionsLoading,
  selectedFilters,
  setSelectedFilters,
  filtersActive,
  setFiltersActive,
}) {
  const handleFilterChange = (e) => {
    setFiltersActive((prevData) => ({
      ...prevData,
      [name]: e.target.checked,
    }));
    if (!e.target.checked) {
      setSelectedFilters(filterOptions.map((option) => option.value));
    }
  };
  return (
    <div className="filters">
      <Checkbox
        className="filters--title"
        checked={filtersActive[name]}
        onChange={handleFilterChange}
      >
        {`Filter by ${name}`}
      </Checkbox>
      {filtersActive[name] && (
        <Select
          value={selectedFilters}
          options={[...filterOptions].sort((a, b) =>
            a.label.localeCompare(b.label)
          )}
          filterOption={(input, option) =>
            option.label.toLowerCase().includes(input.toLowerCase())
          }
          onChange={setSelectedFilters}
          onInputKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
            }
          }}
          mode="multiple"
          loading={filterOptionsLoading}
          placeholder={`Select a ${name} to see results`}
          allowClear
          size="small"
          placement="topLeft"
        />
      )}
    </div>
  );
}

CalendarFilter.propTypes = {
  name: PropTypes.string,
  filterOptions: PropTypes.array,
  filterOptionsLoading: PropTypes.bool,
  selectedFilters: PropTypes.array,
  setSelectedFilters: PropTypes.func,
  filtersActive: PropTypes.object,
  setFiltersActive: PropTypes.func,
};
