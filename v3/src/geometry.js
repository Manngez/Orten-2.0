const MAX_MERCATOR_LAT=85.05112878;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function unwrapLon(lon,referenceUx=null){
  let x=Number(lon);
  if(!Number.isFinite(x))return NaN;
  if(referenceUx==null||!Number.isFinite(Number(referenceUx)))return x;
  const ref=Number(referenceUx);
  while(x-ref>180)x-=360;
  while(x-ref< -180)x+=360;
  return x;
}

export function normalizeLon(value){
  const x=Number(value);
  if(!Number.isFinite(x))return NaN;
  const lon=((x+180)%360+360)%360-180;
  return lon===-180?180:lon;
}

export function mercatorY(lat){
  const radians=clamp(Number(lat),-MAX_MERCATOR_LAT,MAX_MERCATOR_LAT)*Math.PI/180;
  return Math.log(Math.tan(Math.PI/4+radians/2));
}

export function inverseMercatorY(y){
  return (2*Math.atan(Math.exp(Number(y)))-Math.PI/2)*180/Math.PI;
}

export function intersection(a,b,c,d){
  const ax=Number(a.x),ay=Number(a.y),bx=Number(b.x),by=Number(b.y),cx=Number(c.x),cy=Number(c.y),dx=Number(d.x),dy=Number(d.y);
  if(![ax,ay,bx,by,cx,cy,dx,dy].every(Number.isFinite))return null;
  const rx=bx-ax,ry=by-ay,sx=dx-cx,sy=dy-cy;
  const den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-12)return null;
  const qx=cx-ax,qy=cy-ay;
  const t=(qx*sy-qy*sx)/den;
  const u=(qx*ry-qy*rx)/den;
  const eps=1e-8;
  if(t<=eps||t>1+eps||u<=eps||u>=1-eps)return null;
  return {x:ax+t*rx,y:ay+t*ry,t,u};
}

export function intersectionOf(a,b,c,d){
  const A={x:Number(a.ux),y:mercatorY(a.lat)};
  const B={x:Number(b.ux),y:mercatorY(b.lat)};
  const C={x:Number(c.ux),y:mercatorY(c.lat)};
  const D={x:Number(d.ux),y:mercatorY(d.lat)};
  const hit=intersection(A,B,C,D);
  if(!hit)return null;
  return {...hit,lat:inverseMercatorY(hit.y),lon:normalizeLon(hit.x),ux:hit.x};
}

export function segmentParts(a,b){
  const lon1=Number(a.lon),lon2=Number(b.lon);
  if(!Number.isFinite(lon1)||!Number.isFinite(lon2))return [];
  const diff=lon2-lon1;
  if(Math.abs(diff)<=180)return [[[Number(a.lat),lon1],[Number(b.lat),lon2]]];

  if(lon1>0&&lon2<0){
    const adjusted=lon2+360;
    const t=(180-lon1)/(adjusted-lon1);
    const lat=Number(a.lat)+(Number(b.lat)-Number(a.lat))*t;
    return [[[Number(a.lat),lon1],[lat,180]],[[lat,-180],[Number(b.lat),lon2]]];
  }

  if(lon1<0&&lon2>0){
    const adjusted=lon2-360;
    const t=(-180-lon1)/(adjusted-lon1);
    const lat=Number(a.lat)+(Number(b.lat)-Number(a.lat))*t;
    return [[[Number(a.lat),lon1],[lat,-180]],[[lat,180],[Number(b.lat),lon2]]];
  }

  return [[[Number(a.lat),lon1],[Number(b.lat),lon2]]];
}

export function project(lat,lon,width=1000,height=620){
  const x=(normalizeLon(lon)+180)/360*width;
  const maxY=mercatorY(MAX_MERCATOR_LAT);
  const y=(maxY-mercatorY(lat))/(maxY*2)*height;
  return {x,y};
}
