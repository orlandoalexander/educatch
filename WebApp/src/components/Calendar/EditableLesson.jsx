import { useState } from "react";
import { PropTypes } from "prop-types";
import dayjs from "dayjs";
import useGetTutors from "../../hooks/useGetTutors";
import useGetStudents from "../../hooks/useGetStudents";
import useGetLocations from "../../hooks/useGetLocations";
import useGetSubjects from "../../hooks/useGetSubjects";
import useAddLocation from "../../hooks/useAddLocation";
import useAddStudent from "../../hooks/useAddStudent";
import useAddSubject from "../../hooks/useAddSubject";
import useAddTutor from "../../hooks/useAddTutor";
import useAddLesson from "../../hooks/useAddLesson";
import useGetLessonClash from "../../hooks/useGetLessonClash";
import {
  Form,
  Input,
  Button,
  Select,
  Divider,
  DatePicker,
  TimePicker,
  Space,
  message,
  Modal,
  Spin,
  ConfigProvider,
  Switch,
  Tooltip,
} from "antd";
import { X, Plus, AlertCircle, FileText } from "react-feather";
import "rsuite/dist/rsuite.min.css";
import "./EditableLesson.css";
import "./Lesson.css";

const EditableLesson = ({
  handleCloseLesson,
  selectedLesson,
  initialDate,
  openDeleteLessonModal,
  openDeleteRecurringLessonModal,
  handleModifyLessonOccurrence,
  handleModifyLesson,
  handleOpenReport,
  getFormattedTime,
  getDatabaseFormattedTime,
  getTimeZoneAbbreviation,
}) => {
  const [clashDetails, setClashDetails] = useState({
    tutor_id: selectedLesson?.tutor_id,
    student_id: selectedLesson?.student_id,
    start_time: selectedLesson?.start_time,
    end_time: selectedLesson?.end_time,
  });
  const [useRecurrence, setUseRecurrence] = useState(
    selectedLesson?.recurrence_rule
  );
  const [modifiedLessonDate, setModifiedLessonDate] = useState(false);
  const [modifiedRecurrenceType, setModifiedRecurrenceType] = useState(false); // modify frequency or interval of recurrecnce rule
  const [modifiedFields, setModifiedFields] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [lesson, setLesson] = useState({
    title: selectedLesson?.title || "",
    description: selectedLesson?.description || "",
    time:
      selectedLesson?.start_time_short && selectedLesson?.end_time_short
        ? [
            dayjs(selectedLesson?.start_time_short, "HH:mm"),
            dayjs(selectedLesson?.end_time_short, "HH:mm"),
          ]
        : null,
    date: selectedLesson?.date_short
      ? dayjs(selectedLesson?.date_short, "DD-MM-YYYY")
      : initialDate
      ? dayjs(initialDate, "YYYY-MM-DD")
      : null,
    tutor_id: selectedLesson?.tutor_id || "",
    student_id: selectedLesson?.student_id || "",
    location_id: selectedLesson?.location_id || "",
    subject_id: selectedLesson?.subject_id || "",
    recurrence_rule: selectedLesson?.recurrence_rule
      ? {
          frequency: selectedLesson.recurrence_rule
            .split(";")[0]
            .split("=")[1]
            .toLowerCase(),
          interval: parseInt(
            selectedLesson.recurrence_rule.split(";")[1].split("=")[1]
          ),
          until: selectedLesson.recurrence_rule.split(";")[2]
            ? dayjs(
                selectedLesson.recurrence_rule.split(";")[2].split("=")[1],
                "YYYYMMDD"
              )
            : null,
        }
      : {
          frequency: "weekly",
          interval: 1,
          until: null,
        },
  });

  const { data: tutorsData, isLoading: tutorsDataLoading } = useGetTutors();
  const { data: studentsData, isLoading: studentsDataLoading } =
    useGetStudents();
  const { data: locationsData, isLoading: locationsDataLoading } =
    useGetLocations();
  const { data: subjectsData, isLoading: subjectsDataLoading } =
    useGetSubjects();
  const dataLoading =
    tutorsDataLoading ||
    studentsDataLoading ||
    locationsDataLoading ||
    subjectsDataLoading;

  const addTutor = useAddTutor();
  const addStudent = useAddStudent();
  const addLocation = useAddLocation();
  const addSubject = useAddSubject();
  const addLesson = useAddLesson();

  const { data: lessonClashData, isFetching: lessonClashDataFetching } =
    useGetLessonClash({
      lessonOccurrenceId: selectedLesson?.id,
      tutorId: clashDetails.tutor_id,
      studentId: clashDetails.student_id,
      startTime: clashDetails.start_time,
      endTime: clashDetails.end_time,
    });

  const getFormattedData = () => {
    let formattedData = lesson;
    if (useRecurrence) {
      let recurrence_rule_text = "";
      recurrence_rule_text += `FREQ=${lesson.recurrence_rule.frequency};`;
      recurrence_rule_text += `INTERVAL=${lesson.recurrence_rule.interval}`;
      if (formattedData.recurrence_rule.until) {
        const until = formattedData.recurrence_rule.until.toDate();
        recurrence_rule_text += `;UNTIL=${getDatabaseFormattedTime(
          until,
          false
        )}`; // pass false to prevent using utc to avoid changing timezone of extended_until date
      }
      formattedData.recurrence_rule = recurrence_rule_text;
    } else formattedData.recurrence_rule = "";

    const formattedTime = getFormattedTime(lesson.date, lesson.time);
    return {
      ...formattedData,
      start_time: formattedTime.start_time,
      end_time: formattedTime.end_time,
    };
  };

  const handleAddLocation = () => {
    if (!newItem) {
      message.warning("Please enter location name");
    } else {
      addLocation.mutate({ name: newItem });
      setNewItem("");
    }
  };

  const handleAddTutor = () => {
    if (!newItem) {
      message.warning("Please enter tutor name");
    } else {
      addTutor.mutate({ name: newItem });
      setNewItem("");
    }
  };

  const handleAddStudent = () => {
    if (!newItem) {
      message.warning("Please enter student name");
    } else {
      addStudent.mutate({ name: newItem });
      setNewItem("");
    }
  };

  const handleAddSubject = () => {
    if (!newItem) {
      message.warning("Please enter subject name");
    } else {
      addSubject.mutate({ name: newItem });
      setNewItem("");
    }
  };

  const handleInputChange = ({ field, subField, value }) => {
    let updatedClashDetails = clashDetails;
    if (field === "recurrence_rule" && subField === "until") {
      if (
        (value === null && lesson.recurrence_rule?.until) ||
        new Date(value).setHours(0, 0, 0, 0) >=
          new Date(selectedLesson?.start_time || lesson?.time?.[0]).setHours(
            0,
            0,
            0,
            0
          )
      )
        setLesson({
          ...lesson,
          [field]: subField ? { ...lesson[field], [subField]: value } : value,
        });
      else
        message.warning(
          "The recurrence end date must be on/after the lesson date"
        );
    } else {
      setLesson({
        ...lesson,
        [field]: subField ? { ...lesson[field], [subField]: value } : value,
      });
    }

    if (
      field === "recurrence_rule" &&
      (subField === "interval" || subField === "frequency")
    )
      setModifiedRecurrenceType(true);

    if (field === "date") setModifiedLessonDate(true);

    if (field === "tutor_id" || field === "student_id") {
      updatedClashDetails[field] = value;
    }

    if (field === "time" || field === "date") {
      setModifiedFields((prevModifiedFields) => [
        ...prevModifiedFields,
        "start_time",
        "end_time",
      ]);
      if (
        (field === "time" || lesson.time) &&
        (field === "date" || lesson.date)
      ) {
        const formattedTime = getFormattedTime(
          field === "date" ? value : lesson.date,
          field === "time" ? value : lesson.time
        );
        updatedClashDetails.start_time = formattedTime.start_time;
        updatedClashDetails.end_time = formattedTime.end_time;
      }
    } else
      setModifiedFields((prevModifiedFields) => [...prevModifiedFields, field]);

    setClashDetails(updatedClashDetails);
  };

  const handleValidateData = () => {
    if (
      !lesson.title ||
      !lesson.subject_id ||
      !lesson.student_id ||
      !lesson.tutor_id ||
      !lesson.location_id ||
      !lesson.date ||
      !lesson.time
    ) {
      message.warning("Please fill out all required fields");
      return false;
    }

    return true;
  };

  const handleAddLesson = () => {
    if (handleValidateData()) {
      addLesson.mutate(getFormattedData());
      handleCloseLesson();
    }
  };

  return (
    <div className="lesson">
      <Form
        key={dataLoading}
        layout="vertical"
        initialValues={dataLoading ? {} : lesson}
        scrollToFirstError
      >
        <ConfigProvider
          theme={{
            components: {
              Form: {
                itemMarginBottom: "0",
              },
              Input: {
                inputFontSizeLG: "20px",
                paddingInlineLG: "0",
              },
            },
          }}
        >
          <Form.Item
            name="title"
            rules={[
              {
                required: true,
                message: "Please input lesson title",
              },
            ]}
          >
            <header className="lesson--header">
              <Input
                value={lesson.title}
                placeholder="Title"
                variant="borderless"
                size="large"
                style={{ paddingLeft: "0px" }}
                onChange={(e) =>
                  handleInputChange({ field: "title", value: e.target.value })
                }
              />

              <div className="lesson--header-actions">
                {selectedLesson && (
                  <FileText
                    onClick={handleOpenReport}
                    style={{ cursor: "pointer", color: "#0A5E84" }}
                  />
                )}

                <button
                  onClick={() => {
                    modifiedFields.length > 0
                      ? Modal.confirm({
                          title: selectedLesson
                            ? "Discard changes"
                            : "Discard new lesson",
                          content: `Are you sure to discard ${
                            selectedLesson ? "your changes" : "this new lesson"
                          }?`,
                          okText: "Yes",
                          cancelText: "No",
                          onOk: handleCloseLesson,
                          footer: (_, { OkBtn, CancelBtn }) => (
                            <>
                              <CancelBtn />
                              <OkBtn />
                            </>
                          ),
                        })
                      : handleCloseLesson();
                  }}
                >
                  <X strokeWidth={1} />
                </button>
              </div>
            </header>
          </Form.Item>
        </ConfigProvider>

        <Form.Item name="description">
          <ConfigProvider
            theme={{
              components: {
                Input: {
                  paddingInline: "0",
                },
              },
            }}
          >
            <Input
              value={lesson.description}
              placeholder="Description"
              variant="borderless"
              onChange={(e) =>
                handleInputChange({
                  field: "description",
                  value: e.target.value,
                })
              }
            />
          </ConfigProvider>
        </Form.Item>

        <Divider />

        <Form.Item
          required
          label="Tutor"
          name="tutor_id"
          rules={[
            {
              required: true,
              message: "Please select the tutor",
            },
          ]}
        >
          <Select
            className="form--select"
            placeholder={dataLoading ? "Loading..." : null}
            loading={dataLoading && <Spin size="small" />}
            onChange={(value) =>
              handleInputChange({ field: "tutor_id", value: value })
            }
            showSearch
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider
                  style={{
                    margin: "8px 0",
                  }}
                />
                <Space
                  style={{
                    padding: "0 8px 4px",
                  }}
                >
                  <Input
                    placeholder="New tutor"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Button type="text" icon={<Plus />} onClick={handleAddTutor}>
                    Add
                  </Button>
                </Space>
              </>
            )}
            options={tutorsData?.records.map((tutor) => ({
              label: tutor.name,
              value: tutor.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          required
          label="Student"
          name="student_id"
          rules={[
            {
              required: true,
              message: "Please select the student",
            },
          ]}
          className="form--item"
        >
          <Select
            className="form--select"
            placeholder={dataLoading ? "Loading..." : null}
            loading={dataLoading && <Spin size="small" />}
            onChange={(value) =>
              handleInputChange({ field: "student_id", value: value })
            }
            showSearch
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider
                  style={{
                    margin: "8px 0",
                  }}
                />
                <Space
                  style={{
                    padding: "0 8px 4px",
                  }}
                >
                  <Input
                    placeholder="New student"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Button
                    type="text"
                    icon={<Plus />}
                    onClick={handleAddStudent}
                  >
                    Add
                  </Button>
                </Space>
              </>
            )}
            options={studentsData?.records.map((student) => ({
              label: student.name,
              value: student.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          required
          label="Location"
          name="location_id"
          rules={[
            {
              required: true,
              message: "Please select the lesson location",
            },
          ]}
        >
          <Select
            className="form--select"
            placeholder={dataLoading ? "Loading..." : null}
            loading={dataLoading && <Spin size="small" />}
            onChange={(value) =>
              handleInputChange({ field: "location_id", value: value })
            }
            showSearch
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider
                  style={{
                    margin: "8px 0",
                  }}
                />
                <Space
                  style={{
                    padding: "0 8px 4px",
                  }}
                >
                  <Input
                    placeholder="New location"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Button
                    type="text"
                    icon={<Plus />}
                    onClick={handleAddLocation}
                  >
                    Add
                  </Button>
                </Space>
              </>
            )}
            options={locationsData?.records.map((location) => ({
              label: location.name,
              value: location.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          required
          label="Subject"
          name="subject_id"
          rules={[
            {
              required: true,
              message: "Please select the lesson subject",
            },
          ]}
        >
          <Select
            className="form--select"
            placeholder={dataLoading ? "Loading..." : null}
            loading={dataLoading && <Spin size="small" />}
            onChange={(value) =>
              handleInputChange({ field: "subject_id", value: value })
            }
            showSearch
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider
                  style={{
                    margin: "8px 0",
                  }}
                />
                <Space
                  style={{
                    padding: "0 8px 4px",
                  }}
                >
                  <Input
                    placeholder="New subject"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Button
                    type="text"
                    icon={<Plus />}
                    onClick={handleAddSubject}
                  >
                    Add
                  </Button>
                </Space>
              </>
            )}
            options={subjectsData?.records.map((subject) => ({
              label: subject.name,
              value: subject.id,
            }))}
          />
        </Form.Item>

        <Divider />

        <Form.Item
          required
          label="Date"
          name="date"
          rules={[
            {
              required: true,
              message: "Please enter the date of the lesson",
            },
          ]}
        >
          <DatePicker
            value={lesson.date}
            className="form--picker"
            format="DD-MM-YYYY"
            onChange={(value) =>
              handleInputChange({ field: "date", value: value })
            }
          />
        </Form.Item>

        <Form.Item
          required
          label="Time"
          name="time"
          rules={[
            {
              required: true,
              message: "Please enter the lesson start and end time",
            },
          ]}
        >
          <TimePicker.RangePicker
            value={lesson.time}
            className="form--picker"
            format="HH:mm"
            minuteStep={15}
            onChange={(value) =>
              handleInputChange({ field: "time", value: value })
            }
            suffixIcon={
              <span>
                {getTimeZoneAbbreviation(
                  new Date(
                    getFormattedTime(
                      lesson?.date || new Date(),
                      lesson?.time || [new Date(), new Date()]
                    ).start_time
                  )
                )}
              </span>
            }
          />
        </Form.Item>
        {!selectedLesson?.exception_id && (
          <>
            <Divider />

            <ConfigProvider
              theme={{
                components: {
                  Input: {
                    addonBg: "rgba(0, 0, 0, 0)",
                    paddingInline: "0",
                  },
                  Form: {
                    itemMarginBottom: "10px",
                  },
                },
              }}
            >
              <Form.Item
                label="Repeat lesson"
                layout="horizontal"
                colon={false}
              >
                <Switch
                  className="form--switch"
                  checked={useRecurrence}
                  onChange={(value) => {
                    setUseRecurrence(value);
                    setModifiedFields((prevModifiedFields) => [
                      ...prevModifiedFields,
                      "recurrence_rule",
                    ]);
                  }}
                />
              </Form.Item>
              {useRecurrence && (
                <section className="form--recurrence">
                  <Form.Item label="Frequency" layout="horizontal">
                    <Select
                      className="form--select"
                      size="small"
                      loading={dataLoading && <Spin size="small" />}
                      placeholder={dataLoading ? "Loading..." : null}
                      value={lesson.recurrence_rule.frequency}
                      onChange={(value) =>
                        handleInputChange({
                          field: "recurrence_rule",
                          subField: "frequency",
                          value: value,
                        })
                      }
                      options={[
                        { label: "Daily", value: "daily" },
                        { label: "Weekly", value: "weekly" },
                        { label: "Monthly", value: "monthly" },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item>
                    <Input
                      className="form--input-number"
                      size="small"
                      placeholder={dataLoading ? "Loading..." : null}
                      variant="borderless"
                      addonBefore="Every"
                      addonAfter={
                        lesson.recurrence_rule.frequency === "daily"
                          ? "day(s)"
                          : lesson.recurrence_rule.frequency === "weekly"
                          ? "week(s)"
                          : "month(s)"
                      }
                      value={lesson.recurrence_rule.interval}
                      onChange={(e) =>
                        handleInputChange({
                          field: "recurrence_rule",
                          subField: "interval",
                          value: e.target.value,
                        })
                      }
                      min={1}
                    />
                  </Form.Item>

                  <Form.Item label="Until" layout="horizontal">
                    <DatePicker
                      size="small"
                      value={lesson.recurrence_rule.until}
                      className="form--recurrence-picker"
                      format="DD-MM-YYYY"
                      onChange={(value) =>
                        handleInputChange({
                          field: "recurrence_rule",
                          subField: "until",
                          value: value,
                        })
                      }
                    />
                  </Form.Item>
                </section>
              )}
            </ConfigProvider>
          </>
        )}
        <br />

        <Form.Item className="form--buttons">
          {selectedLesson ? (
            <Space>
              <>
                <Button
                  danger
                  onClick={() => {
                    selectedLesson.recurrence_rule &&
                    !modifiedFields.includes("recurrence_rule") &&
                    !selectedLesson.exception_id // if lesson is an exception, it should be deleted as a single lesson
                      ? openDeleteRecurringLessonModal(selectedLesson)
                      : openDeleteLessonModal(selectedLesson);
                  }}
                >
                  Delete
                </Button>

                <Tooltip
                  styles={{ fontSize: "0.7rem" }}
                  placement="topLeft"
                  title={
                    !lessonClashDataFetching &&
                    lessonClashData?.clash &&
                    `Adding this lesson will cause ${
                      lessonClashData?.clash_count === 1
                        ? "a clash with an existing lesson"
                        : `clashes with ${lessonClashData?.clash_count} existing lessons`
                    }`
                  }
                  color="red"
                >
                  <Button
                    htmlType="submit"
                    type="primary"
                    loading={
                      modifiedFields.length > 0 && lessonClashDataFetching
                    }
                    icon={lessonClashData?.clash && <AlertCircle size={17} />}
                    danger={!lessonClashDataFetching && lessonClashData?.clash}
                    disabled={modifiedFields.length === 0}
                    onClick={() => {
                      if (handleValidateData()) {
                        // if haven't modified recurrence rule
                        if (
                          selectedLesson.recurrence_rule &&
                          !modifiedFields.includes("recurrence_rule") &&
                          !selectedLesson.exception_id
                        ) {
                          const modal = Modal.confirm({
                            width: 700,
                            title: "Editing recurring lesson",
                            content: (
                              <>
                                Do you want to edit all occurrences of this
                                lesson, or only the current lesson occurrence?
                                <i>
                                  <br />
                                  <br />
                                  Changes to <b>lesson time</b> will apply to
                                  all <b>future occurrences</b> of the lesson.
                                  <br />
                                  Changes to <b>lesson details</b> (tutor,
                                  student, location, subject) will apply to all{" "}
                                  <b>past and future occurrences</b> of the
                                  lesson.
                                  {modifiedLessonDate && (
                                    <>
                                      <br />
                                      <br />
                                      <b>
                                        NOTE: Changing the lesson date will
                                        erase any future reports for this
                                        lesson.
                                      </b>
                                    </>
                                  )}
                                </i>
                              </>
                            ),
                            okText: `Edit all lesson occurrences`,
                            cancelText: "Dismiss",
                            onOk: () => {
                              handleModifyLesson({
                                lessonId: selectedLesson.lesson_id,
                                headerData: {
                                  lesson_occurrence_id: selectedLesson.id, // lesson occurrence id is required to delete current lesson occurrence
                                  update_type: "MODIFY",
                                },
                                contentData: getFormattedData(),
                                modifiedFields: modifiedFields,
                              });
                            },
                            footer: (_, { OkBtn, CancelBtn }) => (
                              <>
                                <CancelBtn />
                                <Button
                                  onClick={() => {
                                    handleModifyLessonOccurrence({
                                      lessonOccurrenceId: selectedLesson.id,
                                      data: getFormattedData(),
                                      modifiedFields: modifiedFields,
                                    });
                                    modal.destroy();
                                  }}
                                >
                                  Edit only this lesson
                                </Button>
                                <OkBtn />
                              </>
                            ),
                          });
                        }
                        // if lesson is an exception, it should automatically be modified as a single lesson
                        else if (selectedLesson.exception_id)
                          handleModifyLessonOccurrence({
                            lessonOccurrenceId: selectedLesson.id,
                            data: getFormattedData(),
                            modifiedFields: modifiedFields,
                          });
                        // if modifying recurrence rule frequency or interval, ask user to confirm as deletes future reports
                        else if (modifiedRecurrenceType) {
                          Modal.confirm({
                            width: 700,
                            title: "Editing lesson recurrence",
                            content:
                              "Changing the recurrence type will erase any existing future lesson reports for this lesson.",
                            okText: `Edit lesson recurrence`,
                            cancelText: "Dismiss",
                            onOk: () => {
                              handleModifyLesson({
                                lessonId: selectedLesson.lesson_id,
                                headerData: {
                                  lesson_occurrence_id: selectedLesson.id, // lesson occurrence id is required to delete current lesson occurrence
                                  update_type: "MODIFY",
                                },
                                contentData: getFormattedData(),
                                modifiedFields: [
                                  ...modifiedFields,
                                  "start_time", // include start_time and end_time to ensure new lesson starts after the current lesson occurrence start_time (not that of the original lesson)
                                  "end_time",
                                ],
                              });
                            },
                          });
                        } else
                          handleModifyLesson({
                            lessonId: selectedLesson.lesson_id,
                            headerData: {
                              lesson_occurrence_id: selectedLesson.id, // lesson occurrence id is required to delete current lesson occurrence
                              update_type: "MODIFY",
                            },
                            contentData: getFormattedData(),
                            modifiedFields: [
                              ...modifiedFields,
                              "start_time", // include start_time and end_time to ensure new lesson starts after the current lesson occurrence start_time (not that of the original lesson)
                              "end_time",
                            ],
                          });
                      }
                    }}
                  >
                    Save changes
                  </Button>
                </Tooltip>
              </>
            </Space>
          ) : (
            <Space>
              <Button
                key="cancel"
                onClick={() => {
                  Modal.confirm({
                    title: "Discard new lesson",
                    content: "Are you sure to discard this new lesson?",
                    okText: "Yes",
                    cancelText: "No",
                    onOk: handleCloseLesson,
                    footer: (_, { OkBtn, CancelBtn }) => (
                      <>
                        <CancelBtn />
                        <OkBtn />
                      </>
                    ),
                  });
                }}
              >
                Cancel
              </Button>
              <Tooltip
                styles={{ fontSize: "0.7rem" }}
                placement="topLeft"
                title={
                  !lessonClashDataFetching &&
                  lessonClashData?.clash &&
                  `Adding this lesson will cause ${
                    lessonClashData?.clash_count === 1
                      ? "a clash with an existing lesson"
                      : `clashes with ${lessonClashData?.clash_count} existing lessons`
                  }`
                }
                color="red"
              >
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={lessonClashDataFetching}
                  icon={lessonClashData?.clash && <AlertCircle size={17} />}
                  danger={!lessonClashDataFetching && lessonClashData?.clash}
                  onClick={handleAddLesson}
                >
                  Add lesson
                </Button>
              </Tooltip>
            </Space>
          )}
        </Form.Item>
      </Form>
    </div>
  );
};

export default EditableLesson;

EditableLesson.propTypes = {
  handleCloseLesson: PropTypes.func,
  openDeleteLessonModal: PropTypes.func,
  openDeleteRecurringLessonModal: PropTypes.func,
  handleModifyLessonOccurrence: PropTypes.func,
  handleModifyLesson: PropTypes.func,
  selectedLesson: PropTypes.object,
  initialDate: PropTypes.string,
  handleOpenReport: PropTypes.func,
  getFormattedTime: PropTypes.func,
  getDatabaseFormattedTime: PropTypes.func,
  getTimeZoneAbbreviation: PropTypes.func,
};
