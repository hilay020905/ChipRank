module tb_counter4;

reg clk, rst;
wire [3:0] count;

counter4 uut (
    .clk(clk),
    .rst(rst),
    .count(count)
);

// Generate VCD
initial begin
    $dumpfile("counter.vcd");
    $dumpvars(0, tb_counter4);
end

// 10 ns clock period
initial begin
    clk = 0;
    forever #5 clk = ~clk;
end

// Test sequence
initial begin
    rst = 1;
    #12;
    rst = 0;

    #100;
    $finish;
end

// Display values
initial begin
    $display("Time\tRST\tCOUNT");
    $monitor("%0t\t%b\t%d", $time, rst, count);
end

endmodule