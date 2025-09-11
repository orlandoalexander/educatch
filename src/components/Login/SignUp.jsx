import { useContext, useState } from "react";
import { Button, Form, Input } from "antd";
import { Lock, Mail, User } from "react-feather";
import logo from "../../assets/EduCatch-logo_small.png";
import useAddUser from "../../hooks/useAddUser";
import { UserContext } from "../../UserContext";
import "./SignUp.css";
import PropTypes from "prop-types";

export default function SignUp({ setIsSignIn }) {
  const { handleSignIn } = useContext(UserContext);
  const addUser = useAddUser(handleSignIn);
  const [loading, setLoading] = useState(false);

  const onFinish = (data) => {
    setLoading(true);
    addUser.mutate(data, {
      onSuccess: () => {
        setLoading(false);
        setIsSignIn(true);
      },
      onError: () => setLoading(false),
    });
  };

  return (
    <div className="signup">
      <img className="signup--logo" src={logo} alt="EduCatch logo" />
      <h2>Create account</h2>
      <span>
        Welcome to Educatch Timetabling! Please enter your details below to
        create your account.
      </span>
      <Form
        className="signup--form"
        name="signup"
        onFinish={onFinish}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          name="name"
          rules={[
            {
              required: true,
              message: "Please input your name",
            },
          ]}
        >
          <Input prefix={<User size={15} color="gray" />} placeholder="Name" />
        </Form.Item>
        <Form.Item
          name="email"
          rules={[
            {
              type: "email",
              required: true,
              message: "Please input your email",
            },
          ]}
        >
          <Input prefix={<Mail size={15} color="gray" />} placeholder="Email" />
        </Form.Item>
        <Form.Item
          name="password"
          extra="Password needs to be at least 8 characters."
          rules={[
            {
              required: true,
              message: "Please input your password",
            },
          ]}
        >
          <Input.Password
            prefix={<Lock size={15} color="gray" />}
            type="password"
            placeholder="Password"
          />
        </Form.Item>
        <Form.Item>
          <Button block loading={loading} type="primary" htmlType="submit">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </Form.Item>
      </Form>
      <div>
        <span>Already have an account? </span>
        <a className="signup--signin" onClick={() => setIsSignIn(true)}>
          Login
        </a>
      </div>
    </div>
  );
}

SignUp.propTypes = {
  setIsSignIn: PropTypes.func,
};
