import { createBrowserRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import LoginPage from "./pages/Login";

const router = createBrowserRouter([
	{ path: "/login", element: <LoginPage/> },
	{ path: "/", element: "How far" },
]);
function App() {
	return <RouterProvider router={router}></RouterProvider>;
}

export default App;
