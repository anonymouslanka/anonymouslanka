import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout, ThemeProvider } from './components/Layout';
import { Skeleton, ToastProvider } from './components/ui';

const Home = lazy(() => import('./pages/Home'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const NewPost = lazy(() => import('./pages/NewPost'));
const EditPost = lazy(() => import('./pages/EditPost'));
const MyPosts = lazy(() => import('./pages/MyPosts'));
const About = lazy(() => import('./pages/Info').then((m) => ({ default: m.About })));
const Guidelines = lazy(() => import('./pages/Info').then((m) => ({ default: m.Guidelines })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64 w-full" /></div>}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="post/:id" element={<PostDetail />} />
                <Route path="new" element={<NewPost />} />
                {/* Only the public post id is in the URL — the edit key is read from this device's storage. */}
                <Route path="edit/:id" element={<EditPost />} />
                <Route path="my-posts" element={<MyPosts />} />
                <Route path="about" element={<About />} />
                <Route path="guidelines" element={<Guidelines />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
