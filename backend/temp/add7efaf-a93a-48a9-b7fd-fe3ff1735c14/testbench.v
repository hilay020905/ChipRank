`timescale 1ns/1ps
module testbench;
  reg clk, rst_n, d;
  wire q;

  dff dut (.clk(clk), .rst_n(rst_n), .d(d), .q(q));

  initial clk = 0;
  always #5 clk = ~clk;

  initial begin
    $dumpfile("sim.vcd");
    $dumpvars(0, testbench);

    rst_n = 0; d = 0;
    #15;
    rst_n = 1;

    @(posedge clk); #1; d = 1;
    @(posedge clk); #1; d = 0;
    @(posedge clk); #1; d = 1;
    @(posedge clk); #1;

    if (q === 1'b1)
      $display("PASS: q=%b after d=1", q);
    else
      $display("FAIL: q=%b expected 1", q);

    // Async reset test
    d = 1; #2; rst_n = 0; #2;
    if (q === 1'b0)
      $display("PASS: async reset works, q=0");
    else
      $display("FAIL: async reset failed, q=%b", q);

    rst_n = 1;
    #20; $finish;
  end
endmodule