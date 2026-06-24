module d_ff (
  input  logic clk,
  input  logic rst_n,
  input  logic d,
  output logic a
);
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 1'b0;
    else        q <= d;
endmodule