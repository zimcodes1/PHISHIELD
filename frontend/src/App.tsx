import { createBrowserRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";

const router = createBrowserRouter([
	{ path: "/login", element: <LoginPage /> },
	{ path: "/signup", element: <SignupPage /> },
	{ path: "/", element: "How far" },
]);

function App() {
	return <RouterProvider router={router}></RouterProvider>;
}

export default App;
