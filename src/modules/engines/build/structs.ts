
//  wallptr - index to first wall of sector
//  wallnum - number of walls in sector
//  z's - z coordinate (height) of ceiling / floor at first point of sector
//  stat's
//  bit 0: 1 = parallaxing, 0 = not                                 "P"
//  bit 1: 1 = sloped, 0 = not
//  bit 2: 1 = swap x&y, 0 = not                                    "F"
//  bit 3: 1 = double smooshiness                                   "E"
//  bit 4: 1 = x-flip                                               "F"
//  bit 5: 1 = y-flip                                               "F"
//  bit 6: 1 = Align texture to first wall of sector                "R"
//  bits 7-15: reserved
//  picnum's - texture index into art file
//  heinum's - slope value (rise/run) (0-parallel to floor, 4096-45 degrees)
//  shade's - shade offset of ceiling/floor
//  pal's - palette lookup table number (0 - use standard colors)
//  panning's - used to align textures or to do texture panning
//  visibility - determines how fast an area changes shade relative to distance
//  filler - useless byte to make structure aligned
//  lotag, hitag, extra - These variables used by the game programmer only

export class Sector {
  public wallptr:number;
  public wallnum:number;
  public ceilingz:number;
  public floorz:number;
  public ceilingstat:number;
  public floorstat:number;
  public ceilingpicnum:number;
  public ceilingheinum:number;
  public ceilingshade:number;
  public ceilingpal:number;
  public ceilingxpanning:number;
  public ceilingypanning:number;
  public floorpicnum:number;
  public floorheinum:number;
  public floorshade:number;
  public floorpal:number;
  public floorxpanning:number;
  public floorypanning:number;
  public visibility:number;
  public filler:number;
  public lotag:number;
  public hitag:number;
  public extra:number;
}

//  x, y: Coordinate of left side of wall, get right side from next wall's left side
//  point2: Index to next wall on the right (always in the same sector)
//  nextwall: Index to wall on other side of wall (-1 if there is no sector)
//  nextsector: Index to sector on other side of wall (-1 if there is no sector)
//  cstat:
//    bit 0: 1 = Blocking wall (use with clipmove, getzrange)         "B"
//  bit 1: 1 = bottoms of invisible walls swapped, 0 = not          "2"
//  bit 2: 1 = align picture on bottom (for doors), 0 = top         "O"
//  bit 3: 1 = x-flipped, 0 = normal                                "F"
//  bit 4: 1 = masking wall, 0 = not                                "M"
//  bit 5: 1 = 1-way wall, 0 = not                                  "1"
//  bit 6: 1 = Blocking wall (use with hitscan / cliptype 1)        "H"
//  bit 7: 1 = Transluscence, 0 = not                               "T"
//  bit 8: 1 = y-flipped, 0 = normal                                "F"
//  bit 9: 1 = Transluscence reversing, 0 = normal                  "T"
//  bits 10-15: reserved
//  picnum - texture index into art file
//  overpicnum - texture index into art file for masked walls / 1-way walls
//  shade - shade offset of wall
//  pal - palette lookup table number (0 - use standard colors)
//  repeat's - used to change the size of pixels (stretch textures)
//  pannings - used to align textures or to do texture panning
//  lotag, hitag, extra - These variables used by the game programmer only

export class Wall {
  public x:number;
  public y:number;
  public point2:number;
  public nextwall:number;
  public nextsector:number;
  public cstat:number;
  public picnum:number;
  public overpicnum:number;
  public shade:number;
  public pal:number;
  public xrepeat:number;
  public yrepeat:number;
  public xpanning:number;
  public ypanning:number;
  public lotag:number;
  public hitag:number;
  public extra:number;
}

//  x, y, z - position of sprite - can be defined at center bottom or center
//  cstat:
//    bit 0: 1 = Blocking sprite (use with clipmove, getzrange)       "B"
//  bit 1: 1 = transluscence, 0 = normal                            "T"
//  bit 2: 1 = x-flipped, 0 = normal                                "F"
//  bit 3: 1 = y-flipped, 0 = normal                                "F"
//  bits 5-4: 00 = FACE sprite (default)                            "R"
//  01 = WALL sprite (like masked walls)
//  10 = FLOOR sprite (parallel to ceilings&floors)
//  bit 6: 1 = 1-sided sprite, 0 = normal                           "1"
//  bit 7: 1 = Real centered centering, 0 = foot center             "C"
//  bit 8: 1 = Blocking sprite (use with hitscan / cliptype 1)      "H"
//  bit 9: 1 = Transluscence reversing, 0 = normal                  "T"
//  bits 10-14: reserved
//  bit 15: 1 = Invisible sprite, 0 = not invisible
//  picnum - texture index into art file
//  shade - shade offset of sprite
//  pal - palette lookup table number (0 - use standard colors)
//  clipdist - the size of the movement clipping square (face sprites only)
//  filler - useless byte to make structure aligned
//  repeat's - used to change the size of pixels (stretch textures)
//  offset's - used to center the animation of sprites
//  sectnum - current sector of sprite
//  statnum - current status of sprite (inactive/monster/bullet, etc.)
//
//  ang - angle the sprite is facing
//  owner, xvel, yvel, zvel, lotag, hitag, extra - These variables used by the
//  game programmer only

export class Sprite {
  public x:number;
  public y:number;
  public z:number;
  public cstat:number;
  public picnum:number;
  public shade:number;
  public pal:number;
  public clipdist:number;
  public filler:number;
  public xrepeat:number;
  public yrepeat:number;
  public xoffset:number;
  public yoffset:number;
  public sectnum:number;
  public statnum:number;
  public ang:number;
  public owner:number;
  public xvel:number;
  public yvel:number;
  public zvel:number;
  public lotag:number;
  public hitag:number;
  public extra:number;
}

export class Board {
  public version:number;
  public posx:number;
  public posy:number;
  public posz:number;
  public ang:number;
  public cursectnum:number;
  public numsectors:number;
  public numwalls:number;
  public numsprites:number;
  public sectors:Sector[];
  public walls:Wall[];
  public sprites:Sprite[];
}

export class Header1 {
  public startX:number;
  public startY:number;
  public startZ:number;
  public startAng:number;
  public startSec:number;
  public unk:number;
}

