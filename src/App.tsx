import { MotionConfig } from 'framer-motion';
import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PwaProvider } from './components/Pwa';
import { ToastProvider } from './components/ui';

const Home = lazy(() => import('./pages/Home'));
const CaseFile = lazy(() => import('./pages/CaseFile'));
const OpenCase = lazy(() => import('./pages/OpenCase'));
const EditCase = lazy(() => import('./pages/EditCase'));
const MyCases = lazy(() => import('./pages/MyCases'));
const About = lazy(() => import('./pages/Info').then((m) => ({ default: m.About })));
const Guidelines = lazy(() => import('./pages/Info').then((m) => ({ default: m.Guidelines })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));

/** Old shared links (/post/:id) keep working. */
function LegacyPost() {
  const { id = '' } = useParams();
  return <Navigate to={`/case/${id}`} replace />;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <PwaProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="case/:id" element={<CaseFile />} />
                <Route path="open-case" element={<OpenCase />} />
                {/* Only the public case id is in the URL — the case key is read from this device's storage. */}
                <Route path="edit/:id" element={<EditCase />} />
                <Route path="my-cases" element={<MyCases />} />
                <Route path="about" element={<About />} />
                <Route path="guidelines" element={<Guidelines />} />
                <Route path="post/:id" element={<LegacyPost />} />
                <Route path="new" element={<Navigate to="/open-case" replace />} />
                <Route path="my-posts" element={<Navigate to="/my-cases" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PwaProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
