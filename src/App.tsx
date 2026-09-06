import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/common/AppShell";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Techniques } from "./pages/Techniques";
import { TechniqueDetail } from "./pages/TechniqueDetail";
import { Recipes } from "./pages/Recipes";
import { RecipeDetail } from "./pages/RecipeDetail";
import { Cooking } from "./pages/Cooking";
import { Ingredients } from "./pages/Ingredients";
import { Profile } from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Home />} />
        <Route path="/techniques" element={<Techniques />} />
        <Route path="/techniques/:id" element={<TechniqueDetail />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route
          path="/cook/:id"
          element={
            <ProtectedRoute>
              <Cooking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ingredients"
          element={
            <ProtectedRoute>
              <Ingredients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
