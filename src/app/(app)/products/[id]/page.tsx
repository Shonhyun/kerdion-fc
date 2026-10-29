'use client';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import ProductEditor from '@/components/views/ProductEditor';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <Suspense><ProductEditor key={id} id={id} /></Suspense>;
}
