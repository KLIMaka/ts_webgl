
int modi(int lh, int rh) {
  return lh - (lh / rh) * rh;
}

ivec2 grid(int id, int w) {
  return ivec2(modi(id, w), id / w);
}