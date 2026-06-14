import Navbar from "@/components/navbar";
import SyncClipboard from "@/components/sync-clipboard";
import Notice from "@/components/notice";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between mx-auto  max-w-5xl">
      <header className="p-6 w-full">
        <Navbar />
      </header>
      <main className="flex-1 p-6  w-full">
        <SyncClipboard />
        <Notice />
      </main>
      <Footer />
    </div>
  );
}
