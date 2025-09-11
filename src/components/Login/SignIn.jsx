import { useContext, useState } from "react";
import { Button, Checkbox, Form, Input } from "antd";
import { Lock, Mail } from "react-feather";
import logo from "../../assets/EduCatch-logo_small.png";
import useLogin from "../../hooks/useLogin";
import { UserContext } from "../../UserContext";
import "./SignIn.css";
import { message } from "antd";
import PropTypes from "prop-types";

export default function SignIn({ setIsSignIn }) {
  const { handleSignIn } = useContext(UserContext);
  const login = useLogin(handleSignIn);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = (data) => {
    setLoading(true);
    setError(false);
    login.mutate(data, {
      onError: (error) => {
        setError(true);
        setLoading(false);
        message.error(
          error.response.data.message ||
            "An error was encountered. Please try again later.",
          5
        );
      },
    });
  };

  return (
    <div className="signin">
      <img className="signin--logo" src={logo} alt="EduCatch logo" />
      <h2>Log in</h2>
      <span>
        Welcome back to Educatch Timetabling! Please enter your details below to
        login.
      </span>

      <Form
        className="signin--form"
        name="signin"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          name="email"
          validateStatus={`${error ? "error" : ""}`}
          onChange={() => setError(false)}
          rules={[
            {
              type: "email",
              required: true,
              message: "Please a valid email",
            },
          ]}
        >
          <Input prefix={<Mail size={15} color="gray" />} placeholder="Email" />
        </Form.Item>

        <Form.Item
          name="password"
          validateStatus={`${error ? "error" : ""}`}
          onChange={() => setError(false)}
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
        <Form.Item className="signin--form-footer">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox className="signin--form-remember">Remember me</Checkbox>
          </Form.Item>
          <a
            onClick={() => message.warning("Feature under development")}
            className="signin--form-forgot-password"
          >
            Forgot password?
          </a>
        </Form.Item>
        <Form.Item>
          <Button block loading={loading} type="primary" htmlType="submit">
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </Form.Item>
      </Form>
      <div>
        <span>Don't have an account? </span>
        <a className="signin--signup" onClick={() => setIsSignIn(false)}>
          Create account
        </a>
      </div>
    </div>
  );
}

SignIn.propTypes = {
  setIsSignIn: PropTypes.func,
};
