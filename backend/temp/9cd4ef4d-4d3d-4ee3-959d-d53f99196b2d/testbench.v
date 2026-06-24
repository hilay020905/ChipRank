`timescale 1ns/1ps
module testbench;
  reg clk, rst_n, d, q;

  d_ff dut (.clk(clk), .rst_n(rst_n), .d(d), .q(q));

  initial clk = 0;
  always #5 clk = ~clk;

  initial begin
    $dumpfile("sim.vcd");
    $dumpvars(0, testbench);
    rst_n = 0; d = 0;
    #15;
    rst_n = 1;
    @(posedge clk); d = 1;
    @(posedge clk); d = 0;
    @(posedge clk); d = 1;
    @(posedge clk);
    if (q === 1'b1)
      $display("PASS: q=%b (expected 1)", q);
    else
      $display("FAIL: q=%b (expected 1)", q);
    #20 $finish;
  end
endmodule