import type { APIRoute } from 'astro';
import { iconSvg } from '../lib/icons';

export const GET: APIRoute = () =>
  new Response(iconSvg('site'), { headers: { 'Content-Type': 'image/svg+xml' } });
