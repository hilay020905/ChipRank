`timescale 1ns/1ps
module testbench;
  reg wr_clk, rd_clk, rst_n, wr_en, rd_en;
  reg [7:0] wr_data;
  wire [7:0] rd_data;
  wire full, empty;

  fifo_async #(.DEPTH(16)) dut (
    .wr_clk(wr_clk), .rd_clk(rd_clk), .rst_n(rst_n),
    .wr_en(wr_en), .rd_en(rd_en),
    .wr_data(wr_data), .rd_data(rd_data),
    .full(full), .empty(empty)
  );

  initial wr_clk = 0; always #5  wr_clk = ~wr_clk;
  initial rd_clk = 0; always #7  rd_clk = ~rd_clk;

  initial begin
    $dumpfile("sim.vcd");
    $dumpvars(0, testbench);

    rst_n=0; wr_en=0; rd_en=0; wr_data=0;
    #20; rst_n=1;

    if (empty) $display("PASS: empty after reset");
    else       $display("FAIL: expected empty after reset");

    wr_en=1;
    @(posedge wr_clk); wr_data=8'hAA;
    @(posedge wr_clk); wr_data=8'hBB;
    @(posedge wr_clk); wr_data=8'hCC;
    @(posedge wr_clk); wr_data=8'hDD;
    wr_en=0;

    #30;
    rd_en=1;
    @(posedge rd_clk); #2;
    $display("rd_data=0x%h full=%b empty=%b", rd_data, full, empty);
    @(posedge rd_clk); #2;
    rd_en=0;

    #50;
    $display("Simulation complete");
    $finish;
  end
endmodule