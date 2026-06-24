module testbench;

reg clk, rst;
wire [3:0] count;

counter4 uut (
    .clk(clk),
    .rst(rst),
    .count(count)
);

initial begin
    $dumpfile("sim.vcd");
    $dumpvars(0, testbench);
end

initial begin
    clk = 0;
    forever #5 clk = ~clk;
end

initial begin
    rst = 1;
    #12 rst = 0;
    #100 $finish;
end

endmodule