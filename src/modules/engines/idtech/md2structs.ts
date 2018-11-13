
export class Md2Header {
  public ident:number;              // magic number. must be equal to "IDP2"
  public version:number;            // md2 version. must be equal to 8

  public skinwidth:number;          // width of the texture
  public skinheight:number;         // height of the texture
  public framesize:number;          // size of one frame in bytes

  public num_skins:number;          // number of textures
  public num_xyz:number;            // number of vertices
  public num_st:number;             // number of texture coordinates
  public num_tris:number;           // number of triangles
  public num_glcmds:number;         // number of opengl commands
  public num_frames:number;         // total number of frames

  public ofs_skins:number;          // offset to skin names (64 bytes each)
  public ofs_st:number;             // offset to s-t texture coordinates
  public ofs_tris:number;           // offset to triangles
  public ofs_frames:number;         // offset to frame data
  public ofs_glcmds:number;         // offset to opengl commands
  public ofs_end:number;            // offset to end of file
}

export class Vector3d {
  public x:number;
  public y:number;
  public z:number;
}

export class Vertex {
  public x:number;
  public y:number;
  public z:number;
  public normal_idx:number;
}

export class TexCoord {
  public u:number;
  public v:number;
}

export class Frame {
  public scale:number[];    // scale values
  public translate:number[];// translation vector
  public name:string;       // frame name
  public verts:Vertex[];    // first vertex of this frame
}

export class Triangle {
  public index_xyz:number[];
  public index_uv:number[];
}

export class Md2File {
  public header:Md2Header;
  public skins:string;
  public tcs:TexCoord[];
  public tris:Triangle[];
  public frames:Frame[];
}