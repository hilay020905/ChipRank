module d_ff (
  input  reg clk,
  input  reg rst_n,
  input  reg d,
  output reg q
);
  always @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 1'b0;
    else        q <= d;
endmodule