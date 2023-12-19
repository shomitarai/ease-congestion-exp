import HeaderComponent from "../ui/header";
import FooterComponent from "../ui/footer";

export default function Notification() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-0 text-center">
      <HeaderComponent />
      <h1 className="text-2xl text-center mt-24">Comming soon...</h1>
      <FooterComponent />
    </main>
  );
}
