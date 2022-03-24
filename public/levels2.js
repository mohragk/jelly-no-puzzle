

 /*****************************
  *********  LEGEND: **********
    regular tiles:      { r, g, b }         -> color
    black tiles:        { 0, 1, 2, ...}     -> hard coded ID
    anchored tiles:     [
        { a }           -> prefix
        { N, S, E, W }  -> anchor position (North, South, etc.).
        { r, g, b }     -> color, including black
    ]
 ******************************
 ******************************/

export const levels = [

    
//1
    [
        "xxxxxxxxxxxxx",
        "xxxx     xxxx",
        "xxxx     xxxx",
        "xxxx  b  xxxx",
        "xxxxr r bxxxx",
        "xxxxx xxxxxxx",
        "xxxxxxxxxxxxx",
    ],
//2
    [
        "xxxxxxxxxxxxx",
        "xxxx     xxxx",
        "xxxx  b  xxxx",
        "xxxxg r  xxxx",
        "xxxxr b  xxxx",
        "xxxxx x xxxxx",
        "xxxxx xgxxxxx",
        "xxxxxxxxxxxxx",
    ],


    
//3 
    ["xxxxxxxxxxxxxx", "x            x", "x            x", "x      r     x", "x      xx    x", "x  g     r b x", "xxbxxxg xxxxxx", "xxxxxxxxxxxxxx"], 
   
//4
    ["xxxxxxxxxxxxxx", "x            x", "x            x", "x            x", "x     g   g  x", "x   r r   r  x", "xxxxx x x xxxx", "xxxxxxxxxxxxxx"], 
//5  
    [
        "xxxxxxxxxxxxx",
        "xxx    xxxxxx",
        "xxx g   rxxxx",
        "xxx b   xxxxx",
        "xxx r    aEgxxx",
        "xxx x    xxxx",
        "xxx x     bxx",
        "xxxxxxxxxxxxx",
    ],
//6   
    ["xxxxxxxxxxxxxx", "x            x", "x            x", "x   bg  x g  x", "xxx xxxrxxx  x", "x      b     x", "xxx xxxrxxxxxx", "xxxxxxxxxxxxxx"], 
//7
    ["xxxxxxxxxxxxxx", "x            x", "x       r    x", "x       b    x", "x       x    x", "x b r        x", "x b r      b x", "xxx x      xxx", "xxxxx xxxxxxxx", "xxxxxxxxxxxxxx"], 

//8
    ["xxxxxxxxxxxxxx", "x            x", "x            x", "xrg  gg      x", "xxx xxxx xx  x", "xrg          x", "xxxxx  xx   xx", "xxxxxx xx  xxx", "xxxxxxxxxxxxxx"], 
//9   
    ["xxxxxxxxxxxxxx", "xxxxxxx      x", "xxxxxxx g    x", "x       xx   x", "x r   b      x", "x x xxx x g  x", "x         x bx", "x       r xxxx", "x   xxxxxxxxxx", "xxxxxxxxxxxxxx"], 
//10   
    ["xxxxxxxxxxxxxx", "x            x", "x          r x", "x          x x", "x     b   b  x", "x     x  rr  x", "x         x  x", "x r  bx x x  x", "x x  xx x x  x", "xxxxxxxxxxxxxx"], 
//11
    ["xxxxxxxxxxxxxx", "xxxx x  x xxxx", "xxx  g  b  xxx", "xx   x  x   xx", "xx   aNb  aNg   xx", "xxg        bxx", "xxxg      bxxx", "xxxx      xxxx", "xxxxxxxxxxxxxx"], 
//12
    ["xxxxxxxxxxxxxx", "x            x", "x            x", "x          rbx", "x    x     xxx", "xb        00xx", "xx  rx  x xxxx", "xxxxxxxxxxxxxx"], 
//13
    [
        "xxxxxxxxxxxxx",
        "xx  r    x  x",
        "x   g    aNr  x",
        "x   b      bx",
        "x   g     gxx",
        "x   x     xxx",
        "xxx x      xx",
        "xxxxxxxxxxxxx",
    ],
//14
    ["xxxxxxxxxxxxxx", "x   gr       x", "x   00 1     x", "x    x x xxxxx", "x            x", "x  x  x      x", "x        x  aErx", "xx   x     aEgxx", "x          xxx", "xxxxxxxxxxxxxx"], 
//15
    ["xxxxxxxxxxxxxx", "x      aEg00aWg gx", "x       xxx xx", "x           gx", "x11         xx", "xxx          x", "x       g    x", "x   x xxx   aSgx", "x   xxxxxx xxx", "xxxxxxxxxxxxxx"], 
//16
    ["xxxxxxxxxxxxxx", "xxr rr  rr rxx", "xxx  x  x  xxx", "x            x", "xb          aSbx", "xx          xx", "x            x", "x            x", "x   xxxxxx   x", "xxxxxxxxxxxxxx"], 
//17
    ["xxxxxxxxxxxxxx", "xxxxxxxxxxxxxx", "xxxxx gr xxxxx", "xxxxx rb xxxxx", "xxxxx gr xxxxx", "xxxxx bg xxxxx", "xxxxxxxxxxxxxx", "xxxxxxxxxxxxxx"], 
//18
    ["xxxxxxxxxxxxxx", "xxxxxxxxx   rx", "xxxxxxxxx   gx", "xxxxxxxxx   gx", "x1122       gx", "x1122       gx", "x0033      xxx", "x0033      xxx", "xxaSr x aSgxxx xxx", "xxxxxxxxxxxxxx"], 
//19
    ["xxxxxxxxxxxxxx", "xr r r      rx", "xg x x      gx", "xaWb          bx", "xxxxx     xxxx", "xxxxxx   xxxxx", "xxxxxx   xxxxx", "xxxxxx   xxxxx", "xxxxxxaSgaSgaSgxxxxx", "xxxxxxxxxxxxxx"], 
//20
    ["xxxxxxxxxxxxxx", "xx   0001233rx", "xx   0411233xx", "xx   444122xxx",  "xx     xxxxxxx", "xaWr     xxxxxxx","xx     xxxxxxx", "xx     xxxxxxx", "xx     xxxxxxx",  "xxxxxxxxxxxxxx"], 
//21  
    ["xxxxxxxxxxxxxx", "xxxx000xxxgb x", "xxxx0     bg x", "xxxx0    11xxx", "xxxx000xxxxxxx", "x 222  xxxxxxx", "xxxx     xxaNgxx", "xxxx   g    aNbx", "xxxx   x     x", "xxxxxxxxxxxxxx"], 
//22
    ["xxxxxxxxxxxxxx", "x            x", "xb01         x", "xb0gg     g  x", "xb023     g4sbx", "xxxxx g   xxxx", "xxxxx gg  xxxx", "xxxxx ggg xxxx", "xxxxx ggggxxxx", "xxxxxxxxxxxxxx"], 
    
//23
    ["xxxxxxxxxxxxxx", 
    "xaEg0    aEg1aWgx  x", 
    "x 2aWg    1 x  x", 
    "x333    4 x  x", 
    "xaNg aNg   gaNgg   x", 
    "xxx     xxx  x", 
    "xxx     xxx  x", 
    "xxx     xxx  x", 
    "xxx          x", 
    "xxxxxxxxxxxxxx"], 
//24    
    ["xxxxxxxxxxxxxx", "xrrrr   rggxxx", "xxxb    xxxxxx", "xxxx       xaNbx", "xx           x", "xx           x", "xx     x     x", "xx x         x", "xx        x  x", "xxxxxxxxxxxxxx"], 
];


