export function intersection(a,b,c,d){
  const ax=a.x,ay=a.y,bx=b.x,by=b.y,cx=c.x,cy=c.y,dx=d.x,dy=d.y;
  const rx=bx-ax,ry=by-ay,sx=dx-cx,sy=dy-cy;
  const den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-9)return null;
  const qx=cx-ax,qy=cy-ay;
  const t=(qx*sy-qy*sx)/den;
  const u=(qx*ry-qy*rx)/den;
  const eps=1e-7;
  if(t<=eps||t>=1-eps||u<=eps||u>=1-eps)return null;
  return {x:ax+t*rx,y:ay+t*ry,t,u};
}

export function project(lat,lon){
  return {x:(Number(lon)+180)/360*1000,y:(90-Number(lat))/180*620};
}
