export const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec4 rect;
layout(location=1) in vec4 colorBlur;
layout(location=2) in vec4 motion; // from, to, start, cadence
layout(location=3) in vec4 drum;   // wheel offset, length, glyph width, font size
uniform vec2 viewport;
uniform float now;
uniform int wheels[128];
out vec2 uv;
out vec3 color;
out float softness;
out float shade;
out vec2 atlasUV;
flat out float blurStrength;
flat out int glyph;

float fall(float x) {
  // Invert cubic-bezier(.6,0,1,.5). Same curve as the DOM falling half.
  float lo=0., hi=1.;
  for(int i=0;i<12;i++) {
    float t=(lo+hi)*.5;
    float bx=1.8*(1.-t)*(1.-t)*t+3.*(1.-t)*t*t+t*t*t;
    if(bx<x) lo=t; else hi=t;
  }
  float t=(lo+hi)*.5;
  return 1.5*(1.-t)*t*t+t*t*t;
}
float land(float x) {
  // linear(0, .58, .9, 1, 1.045 78%, 1)
  if(x<.195) return mix(0.,.58,x/.195);
  if(x<.39) return mix(.58,.9,(x-.195)/.195);
  if(x<.585) return mix(.9,1.,(x-.39)/.195);
  if(x<.78) return mix(1.,1.045,(x-.585)/.195);
  return mix(1.045,1.,(x-.78)/.22);
}
void main() {
  int plane=gl_InstanceID%4; // current bottom, next top, landing bottom, falling top
  bool top=plane==1 || plane==3;
  bool moving=plane>=2;
  float progress=clamp((now-motion.z)/motion.w,0.,motion.y-motion.x);
  bool running=now>=motion.z && progress<motion.y-motion.x;
  float phase=fract(progress);
  float face=motion.x+floor(progress);
  if(running && (plane==1 || plane==2)) face+=1.;
  glyph=wheels[int(drum.x)+int(mod(face,drum.y))];
  float turn=0.;
  if(plane==3) turn=phase<.5 ? fall(phase*2.) : 1.;
  if(plane==2) turn=phase<.5 ? 1. : 1.-land((phase-.5)*2.);
  bool visible=!moving || (running && ((plane==3 && phase<.5) || (plane==2 && phase>=.5)));
  vec2 corners[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
  vec2 corner=corners[gl_VertexID];
  float crease=.75/rect.w;
  uv=vec2(corner.x, top ? corner.y*(.5-crease) : .5+crease+corner.y*(.5-crease));
  float angle=turn*1.57079632679*(top ? -1. : 1.);
  vec2 local=vec2((uv.x-.5)*drum.z,(uv.y-.5)*rect.w);
  float z=local.y*sin(angle);
  float w=1.-z/(drum.w*5.);
  vec2 point=rect.xy+vec2(drum.z*.5,rect.w*.5)+vec2(local.x,local.y*cos(angle))/w;
  // Multiply clip-space position by w to retain perspective-correct UV interpolation.
  gl_Position=visible ? vec4((point/viewport*2.-1.)*vec2(1,-1)*w,0,w) : vec4(2,2,0,1);
  color=colorBlur.rgb;
  atlasUV=vec2(32.+(uv.x-.5)*drum.z/drum.w*64.,9.6+uv.y*76.8);
  blurStrength=colorBlur.a;
  softness=moving && colorBlur.a>0. ? clamp(turn,0.,1.) : 0.;
  shade=moving ? mix(1.,.45,clamp(turn,0.,1.)) : 1.;
}`;

export const fragment = `#version 300 es
precision highp float;
uniform sampler2D atlas;
uniform vec2 atlasSize;
in vec2 uv;
in vec3 color;
in float softness;
in float shade;
in vec2 atlasUV;
flat in float blurStrength;
flat in int glyph;
out vec4 outputColor;
void main() {
  // Atlas cells include transparent padding. CSS face line-height is 1.2em.
  vec2 cell=vec2(glyph%8,glyph/8)*vec2(64,96);
  vec2 samplePoint=cell+atlasUV;
  vec3 alpha=texture(atlas,samplePoint/atlasSize).rgb;
  float blurred=blurStrength>1. ? alpha.b : alpha.g;
  float ink=mix(alpha.r,blurred,softness);
  vec3 surface=mix(vec3(27,30,36),vec3(23,26,31),uv.y)/255.;
  float edge=min(uv.x,1.-uv.x);
  float rim=smoothstep(0.,.025,edge);
  outputColor=vec4(mix(surface,color,ink)*shade,rim);
}`;
