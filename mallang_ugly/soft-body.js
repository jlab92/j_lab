/* Spring mesh deformation. Shared texture keeps the face and charms inside the skin. */
(function(root){
'use strict';
class SoftBody {
  constructor(){
    this.cols=26;this.rows=24;this.nodes=[];this.grips=new Map();this.energy=0;
    for(let y=0;y<=this.rows;y++)for(let x=0;x<=this.cols;x++){
      const bx=80+x*640/this.cols,by=100+y*560/this.rows;
      this.nodes.push({bx,by,x:bx,y:by,vx:0,vy:0});
    }
  }
  materialPoint(x,y){
    let best=this.nodes[0],d=Infinity;
    for(const n of this.nodes){const q=(n.x-x)**2+(n.y-y)**2;if(q<d){d=q;best=n}}
    return {x:x-(best.x-best.bx),y:y-(best.y-best.by)};
  }
  grab(id,x,y,pressure=.5){const a=this.materialPoint(x,y);this.grips.set(id,{ax:a.x,ay:a.y,x,y,pressure,age:0});}
  move(id,x,y,pressure=.5){const g=this.grips.get(id);if(g){g.x=x;g.y=y;g.pressure=pressure}}
  release(id){this.grips.delete(id)}
  clear(){this.grips.clear()}
  step(dt=1,reduced=false){
    dt=Math.min(2,Math.max(.05,dt));
    for(const g of this.grips.values())g.age+=dt;
    const targets=this.nodes.map(n=>{
      let dx=0,dy=0;
      for(const g of this.grips.values()){
        const rx=n.bx-g.ax,ry=n.by-g.ay;
        const fall=Math.exp(-(rx*rx+ry*ry)/(2*148*148));
        const broad=Math.exp(-(rx*rx+ry*ry)/(2*270*270));
        let nx=(g.ax-400)/235,ny=(g.ay-420)/200;
        const nl=Math.hypot(nx,ny);if(nl<.32){nx=0;ny=-1}else{nx/=nl;ny/=nl}
        const pressure=.8+Math.min(1,g.age/48)*.35+g.pressure*.2;
        const dragX=Math.max(-235,Math.min(235,g.x-g.ax));
        const dragY=Math.max(-235,Math.min(235,g.y-g.ay));
        const pulled=Math.min(1,Math.hypot(dragX,dragY)/130);
        // Indentation folds the nearest surface inward; adjacent material bulges.
        dx+=(-nx*87-rx*.22)*fall*pressure*(1-pulled*.55);
        dy+=(-ny*87-ry*.18)*fall*pressure*(1-pulled*.55);
        dx+=(n.bx-400)*.115*broad*pressure;
        dy+=(610-n.by)*.05*broad*pressure;
        // Dragging is anchored to the grabbed material, not to the whole toy.
        dx+=dragX*fall*1.13;dy+=dragY*fall*1.13;
        // Wide, asymmetric kneading under the fingertip.
        dx+=Math.sin((n.by-g.ay)/95)*dragX*.12*broad;
        dy+=Math.sin((n.bx-g.ax)/95)*dragY*.1*broad;
      }
      const factor=reduced?.5:1;
      return {x:n.bx+Math.max(-270,Math.min(270,dx))*factor,y:n.by+Math.max(-250,Math.min(250,dy))*factor};
    });
    for(let sub=0;sub<2;sub++){
      const h=dt/2;
      this.nodes.forEach((n,i)=>{
        const t=targets[i],k=this.grips.size?.115:.065;
        n.vx+=(t.x-n.x)*k*h;n.vy+=(t.y-n.y)*k*h;
        const damping=Math.pow(reduced?.68:(this.grips.size?.79:.9),h);
        n.vx*=damping;n.vy*=damping;n.x+=n.vx*h;n.y+=n.vy*h;
      });
    }
    this.energy=this.nodes.reduce((s,n)=>s+Math.abs(n.x-n.bx)+Math.abs(n.y-n.by),0)/this.nodes.length;
  }
}
class SoftRenderer {
  constructor(mesh){
    this.mesh=mesh;this.canvas=document.createElement('canvas');this.canvas.width=800;this.canvas.height=720;
    const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:true});this.gl=gl;
    if(!gl){this.fallback=this.canvas.getContext('2d');return}
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
    const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec2 a; attribute vec2 uv; varying vec2 v; void main(){v=uv;gl_Position=vec4(a.x/400.-1.,1.-a.y/360.,0.,1.);}'));
    gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform sampler2D tex; varying vec2 v; void main(){gl_FragColor=texture2D(tex,v);}'));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Mesh shader link failed');gl.useProgram(p);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,offset]of [['a',0],['uv',8]]){const loc=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,16,offset)}
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.indices=[];const stride=mesh.cols+1;
    for(let y=0;y<mesh.rows;y++)for(let x=0;x<mesh.cols;x++){const a=y*stride+x,b=a+1,c=a+stride,d=c+1;this.indices.push(a,b,c,b,d,c)}
    this.vertices=new Float32Array(this.indices.length*4);
  }
  draw(texture){
    const gl=this.gl;
    if(!gl){
      // CPU fallback: small affine triangles retain local deformation without WebGL.
      const c=this.fallback;c.clearRect(0,0,800,720);const m=this.mesh,s=m.cols+1;
      const tri=(a,b,d)=>{const den=(b.bx-a.bx)*(d.by-a.by)-(d.bx-a.bx)*(b.by-a.by);const A=((b.x-a.x)*(d.by-a.by)-(d.x-a.x)*(b.by-a.by))/den,B=((b.y-a.y)*(d.by-a.by)-(d.y-a.y)*(b.by-a.by))/den,C=((d.x-a.x)*(b.bx-a.bx)-(b.x-a.x)*(d.bx-a.bx))/den,D=((d.y-a.y)*(b.bx-a.bx)-(b.y-a.y)*(d.bx-a.bx))/den;c.save();c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(d.x,d.y);c.closePath();c.clip();c.transform(A,B,C,D,a.x-A*a.bx-C*a.by,a.y-B*a.bx-D*a.by);c.drawImage(texture,0,0);c.restore()};
      for(let y=0;y<m.rows;y++)for(let x=0;x<m.cols;x++){const i=y*s+x;tri(m.nodes[i],m.nodes[i+1],m.nodes[i+s]);tri(m.nodes[i+1],m.nodes[i+s+1],m.nodes[i+s])}return this.canvas;
    }
    let i=0;for(const index of this.indices){const n=this.mesh.nodes[index];this.vertices[i++]=n.x;this.vertices[i++]=n.y;this.vertices[i++]=n.bx/800;this.vertices[i++]=n.by/720}
    gl.viewport(0,0,800,720);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);gl.drawArrays(gl.TRIANGLES,0,this.indices.length);return this.canvas;
  }
}
root.SoftBody=SoftBody;root.SoftRenderer=SoftRenderer;
if(typeof module!=='undefined')module.exports={SoftBody};
})(typeof window!=='undefined'?window:globalThis);
