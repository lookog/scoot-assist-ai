import { ReactNode } from "react";
import Navigation from "@/components/Navigation";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Main content with bottom padding for navigation */}
      <main className="pb-20">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <Navigation />
    </div>
  );
};

export default MainLayout;