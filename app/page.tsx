import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { TVApp } from "./components/TVApp";

export default function Home() {
  return (
    <main>
      <FirebaseAuthProvider>
        <TVApp />
      </FirebaseAuthProvider>
    </main>
  );
}
