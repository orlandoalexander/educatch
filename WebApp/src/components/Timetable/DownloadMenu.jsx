import { useContext, useState } from "react";
import { Button, Dropdown, Radio, Select, DatePicker, Tooltip } from "antd";
import { Download } from "react-feather";
import { UserContext } from "../../UserContext";
import useGetTutors from "../../hooks/useGetTutors";
import useGetStudents from "../../hooks/useGetStudents";
import useCreateTimetablePDF from "../../hooks/useCreateTimetablePDF.js";
import "./DownloadMenu.css";

const { RangePicker } = DatePicker;

export default function DownloadMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("tutor");
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState("week");
  const [customDateRange, setCustomDateRange] = useState(null);
  const { user } = useContext(UserContext);
  const { role, role_id } = user;

  const { data: tutorsData, isLoading: tutorsDataLoading } = useGetTutors();
  const { data: studentsData, isLoading: studentsDataLoading } =
    useGetStudents();

  const createTimetablePDF = useCreateTimetablePDF();

  const roleOptions = {
    tutor: tutorsData?.records
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),

    student: studentsData?.records
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };

  const handleCreateTimetablePDF = () => {
    let startDate = "";
    let endDate = "";
    const today = new Date();
    if (selectedDateRange == "week") {
      // set startDate and endDate to today (backend handles complete weeks automatically)
      startDate = endDate = today.toISOString();
    } else if (selectedDateRange == "month") {
      // first and last day of current month
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = firstDay.toISOString();
      endDate = lastDay.toISOString();
    } else {
      startDate = customDateRange[0].format("YYYY-MM-DDTHH:mm:ss");
      endDate = customDateRange[1].format("YYYY-MM-DDTHH:mm:ss");
    }
    createTimetablePDF.mutate({
      role: role === "admin" ? selectedRole : role,
      role_ids: role === "admin" ? selectedRoleIds : [role_id],
      start_date: startDate,
      end_date: endDate,
    });
    setMenuOpen(false);
  };

  const items = [
    {
      label: (
        <div
          className="dropdown-container"
          onClick={(e) => e.stopPropagation()}
        >
          {role === "admin" && (
            <section>
              <p>Role</p>
              <Radio.Group
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setSelectedRoleIds([]);
                }}
                value={selectedRole}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <Radio value="tutor">Tutor</Radio>
                <Radio value="student">Student</Radio>
              </Radio.Group>

              <Select
                key={selectedRole}
                loading={tutorsDataLoading || studentsDataLoading}
                options={roleOptions[selectedRole]}
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
                placeholder={`Select ${
                  selectedRole === "tutor" ? "tutor(s)" : "student(s)"
                }`}
                values={selectedRoleIds}
                onChange={(values) => setSelectedRoleIds(values)}
                onInputKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                  }
                }}
                mode="multiple"
                showSearch
                allowClear
                size="small"
                placement="topLeft"
                dropdownStyle={{ width: 200 }}
              />
            </section>
          )}
          <section>
            <p>Date range</p>
            <Radio.Group
              onChange={(e) => setSelectedDateRange(e.target.value)}
              value={selectedDateRange}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Radio value="week">This week</Radio>
              <Radio value="month">This month</Radio>
              <Radio value="custom">Choose specific weeks</Radio>
            </Radio.Group>

            {selectedDateRange === "custom" && (
              <RangePicker
                className="form--picker"
                format="DD-MM-YYYY"
                onChange={(date) => setCustomDateRange(date)}
                style={{ maxWidth: "80%" }}
              />
            )}
          </section>
          <Tooltip
            title={
              selectedDateRange === "custom" && customDateRange === null
                ? "Please select a start and end date"
                : role === "admin" &&
                  (!selectedRoleIds || selectedRoleIds.length === 0)
                ? `Select at least one ${selectedRole}`
                : ""
            }
          >
            <Button
              type="primary"
              onClick={handleCreateTimetablePDF}
              disabled={
                (role === "admin" &&
                  (!selectedRoleIds || selectedRoleIds.length === 0)) ||
                (selectedDateRange === "custom" && customDateRange === null)
              }
            >
              Download Timetable(s)
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={["click"]}
      overlayClassName="dropdown-menu"
      open={menuOpen}
      onOpenChange={setMenuOpen}
    >
      <Button icon={<Download size={15} />}>Download</Button>
    </Dropdown>
  );
}
